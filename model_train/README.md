# Model Train Workflow

Bu klasor artik iki ana amac icin kullanilir:

1. Yerel sentiment modelini egitmek
2. Scraper'dan gelen son haberleri yerel modelle etiketlemek

## 1. Veriyi tekillestir

```powershell
powershell -ExecutionPolicy Bypass -File .\dedupe_data.ps1
```

## 2. Etiketlenecek ornek veri hazirla

```powershell
python .\prepare_sample.py --sample-size 200
```

## 3. Modeli egit

```powershell
python .\train_local.py
```

Egitim sonrasinda:

- model `bist_bert_model/`
- raporlar `artifacts/reports/`

## 4. Hizli test

```powershell
python .\predict.py --text "Sirket yeni yatirim tesviki aldi."
```

## 5. Son haberleri etiketle

Varsayilan olarak en guncel `tr_haberler*.csv` dosyasini bulur:

```powershell
python .\label_latest_news.py --min-score 0.80
```

Istersen dosya vererek de calistirabilirsin:

```powershell
python .\label_latest_news.py --input ..\scrapers\news_scraper\bist-news-data\tr_haberler_215206_fixed-2.csv --min-score 0.80
```
