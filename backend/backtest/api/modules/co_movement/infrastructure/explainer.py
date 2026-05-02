from __future__ import annotations

import json
import logging
import os
from typing import Any

_log = logging.getLogger(__name__)


class CoMovementExplainer:
    def __init__(self) -> None:
        self._model = os.environ.get("CO_MOVEMENT_EXPLAIN_MODEL", os.environ.get("AI_SUMMARY_MODEL", "gemini-2.5-flash"))
        self._project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        self._location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

    def explain(
        self,
        *,
        top_pairs: list[dict[str, Any]],
        communities: list[dict[str, Any]],
        metrics: dict[str, Any],
        language: str,
        symbols: list[str] | None = None,
        date_range: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        fallback = self._heuristic_summary(
            top_pairs=top_pairs,
            communities=communities,
            metrics=metrics,
            language=language,
            symbols=symbols or [],
            date_range=date_range or {},
        )

        client = self._build_client()
        if client is None:
            return fallback

        prompt = self._build_prompt(
            top_pairs=top_pairs,
            communities=communities,
            metrics=metrics,
            language=language,
            symbols=symbols or [],
            date_range=date_range or {},
        )
        summary = self._generate_text(client=client, prompt=prompt)
        if not summary:
            return fallback

        return {
            "summary": summary.strip(),
            "warnings": fallback["warnings"],
            "source": "llm",
            "model": self._model,
        }

    def _build_client(self) -> Any | None:
        try:
            from google import genai
        except Exception as exc:  # pragma: no cover - optional runtime
            _log.error("[CoMovementExplainer] google-genai import failed: %s", exc)
            return None

        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                return genai.Client(api_key=api_key)
            except Exception as exc:  # pragma: no cover - optional runtime
                _log.error("[CoMovementExplainer] Client(api_key) failed: %s", exc)

        if not self._project:
            return None

        try:  # pragma: no cover - optional runtime
            return genai.Client(vertexai=True, project=self._project, location=self._location)
        except Exception as exc:
            _log.error("[CoMovementExplainer] Vertex AI client failed: %s", exc)
            return None

    def _generate_text(self, *, client: Any, prompt: str) -> str:
        try:  # pragma: no cover - optional runtime
            from google.genai import types

            response = client.models.generate_content(
                model=self._model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=1024,
                ),
            )
            text = getattr(response, "text", None)
            return text.strip() if isinstance(text, str) else ""
        except Exception as exc:
            _log.error("[CoMovementExplainer] generate_content failed: %s", exc)
            return ""

    def _build_prompt(
        self,
        *,
        top_pairs: list[dict[str, Any]],
        communities: list[dict[str, Any]],
        metrics: dict[str, Any],
        language: str,
        symbols: list[str],
        date_range: dict[str, Any],
    ) -> str:
        return (
            "You are a financial data analysis assistant.\n"
            "Do not give investment advice.\n"
            "Explain detected co-moving stock groups based only on the provided metrics.\n"
            "Mention correlation, DTW similarity, hybrid similarity and community detection results.\n"
            f"Write in clear {'Turkish' if language.lower().startswith('tr') else language}.\n\n"
            f"Symbols: {json.dumps(symbols, ensure_ascii=True)}\n"
            f"Date range: {json.dumps(date_range, ensure_ascii=True, default=str)}\n"
            f"Top pairs: {json.dumps(top_pairs[:12], ensure_ascii=True, default=str)}\n"
            f"Communities: {json.dumps(communities[:8], ensure_ascii=True, default=str)}\n"
            f"Metrics: {json.dumps(metrics, ensure_ascii=True, default=str)}\n"
        )

    def _heuristic_summary(
        self,
        *,
        top_pairs: list[dict[str, Any]],
        communities: list[dict[str, Any]],
        metrics: dict[str, Any],
        language: str,
        symbols: list[str],
        date_range: dict[str, Any],
    ) -> dict[str, Any]:
        if not language.lower().startswith("tr"):
            return self._heuristic_summary_en(
                top_pairs=top_pairs,
                communities=communities,
                metrics=metrics,
                symbols=symbols,
                date_range=date_range,
            )

        summary_parts: list[str] = []
        if symbols:
            summary_parts.append(f"Analiz {len(symbols)} hisse uzerinde calistirildi.")

        start_value = date_range.get("start")
        end_value = date_range.get("end")
        if start_value and end_value:
            summary_parts.append(f"Donem {start_value} ile {end_value} arasini kapsiyor.")

        if top_pairs:
            leader = top_pairs[0]
            summary_parts.append(
                (
                    f"En guclu birlikte hareket eden cift {leader.get('source')}-{leader.get('target')} olarak gorunuyor; "
                    f"hybrid benzerlik {leader.get('hybrid_similarity')}, Pearson {leader.get('pearson')} ve DTW benzerligi {leader.get('dtw_similarity')} seviyesinde."
                )
            )

        if communities:
            largest = max(communities, key=lambda item: item.get("size", 0))
            members = ", ".join(largest.get("stocks", [])[:6])
            summary_parts.append(
                (
                    f"En belirgin community {largest.get('community_id')} numarali grup; "
                    f"{largest.get('size')} hisse iceriyor ve ortalama grup benzerligi {largest.get('avg_similarity')}."
                    f" Bu grupta one cikan hisseler: {members}."
                )
            )

        modularity_score = metrics.get("modularity")
        if modularity_score is not None:
            summary_parts.append(
                f"Graph modularity skoru {modularity_score}; bu skor topluluk ayrisiminin kuvvetini gosteriyor."
            )

        rolling_windows = metrics.get("rolling_window_count")
        if rolling_windows:
            summary_parts.append(
                f"Rolling stability hesaplamasi {rolling_windows} farkli pencere uzerinden de kontrol edildi."
            )

        if not summary_parts:
            summary_parts.append("Saglanan metriklere gore yorumlanabilir bir co-movement ozeti olusturulamadi.")

        return {
            "summary": " ".join(summary_parts),
            "warnings": [
                "Bu sonuc gecmis fiyat verilerine dayanir.",
                "AI katmani hesap yapmaz; yalnizca uretilen metrikleri yorumlar.",
                "Yatirim tavsiyesi degildir.",
            ],
            "source": "heuristic",
            "model": None,
        }

    def _heuristic_summary_en(
        self,
        *,
        top_pairs: list[dict[str, Any]],
        communities: list[dict[str, Any]],
        metrics: dict[str, Any],
        symbols: list[str],
        date_range: dict[str, Any],
    ) -> dict[str, Any]:
        summary_parts: list[str] = []
        if symbols:
            summary_parts.append(f"The analysis covers {len(symbols)} stocks.")
        if date_range.get("start") and date_range.get("end"):
            summary_parts.append(f"The period spans {date_range['start']} to {date_range['end']}.")
        if top_pairs:
            leader = top_pairs[0]
            summary_parts.append(
                (
                    f"The strongest co-moving pair is {leader.get('source')}-{leader.get('target')} with "
                    f"hybrid similarity {leader.get('hybrid_similarity')}, Pearson {leader.get('pearson')} and "
                    f"DTW similarity {leader.get('dtw_similarity')}."
                )
            )
        if communities:
            largest = max(communities, key=lambda item: item.get("size", 0))
            summary_parts.append(
                (
                    f"The largest detected community is {largest.get('community_id')} with {largest.get('size')} stocks "
                    f"and average internal similarity {largest.get('avg_similarity')}."
                )
            )
        if metrics.get("modularity") is not None:
            summary_parts.append(f"Graph modularity is {metrics['modularity']}.")
        if not summary_parts:
            summary_parts.append("The provided metrics are not sufficient to produce a meaningful explanation.")

        return {
            "summary": " ".join(summary_parts),
            "warnings": [
                "These results are based on historical price data.",
                "The AI layer only explains computed metrics and does not perform the calculations.",
                "This is not investment advice.",
            ],
            "source": "heuristic",
            "model": None,
        }
