package com.evalon.shared.presentation.screens.llm

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: String,
    val content: String,
    val isUser: Boolean,
    val timestamp: Long = 0L
)

data class LLMUiState(
    val messages: List<ChatMessage> = emptyList(),
    val inputText: String = "",
    val isTyping: Boolean = false
)

class LLMViewModel {
    private val viewModelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(LLMUiState(
        messages = listOf(
            ChatMessage("welcome", "Merhaba! Ben Evalon AI asistanınım. Hisse analizi, strateji önerileri veya piyasa hakkında sorularınızı sorabilirsiniz.", false)
        )
    ))
    val uiState: StateFlow<LLMUiState> = _uiState.asStateFlow()

    fun onInputChange(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text)
    }

    fun sendMessage() {
        val text = _uiState.value.inputText.trim()
        if (text.isEmpty()) return

        val userMsg = ChatMessage(
            id = "user_${System.currentTimeMillis()}",
            content = text,
            isUser = true,
            timestamp = System.currentTimeMillis()
        )

        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMsg,
            inputText = "",
            isTyping = true
        )

        viewModelScope.launch {
            delay(1500)
            val aiResponse = generateMockResponse(text)
            _uiState.value = _uiState.value.copy(
                messages = _uiState.value.messages + aiResponse,
                isTyping = false
            )
        }
    }

    private fun generateMockResponse(query: String): ChatMessage {
        val response = when {
            query.contains("THYAO", ignoreCase = true) ->
                "THYAO (Türk Hava Yolları) için teknik analiz:\n\n📊 RSI: 58.3 (Nötr)\n📈 MACD: Pozitif kesişim\n🎯 Destek: ₺285 | Direnç: ₺305\n\nGenel görünüm orta vadede olumlu. Sektör ortalamasının üzerinde performans gösteriyor."
            query.contains("strateji", ignoreCase = true) ->
                "Size önerebileceğim stratejiler:\n\n1️⃣ **MACD Kesişim**: Trend takip stratejisi, orta vadeli\n2️⃣ **RSI Dip Avcısı**: Aşırı satım bölgelerinden alım\n3️⃣ **Bollinger Breakout**: Volatilite kırılım stratejisi\n\nHangi strateji hakkında detay istersiniz?"
            else ->
                "Sorunuzu analiz ettim. Daha detaylı bilgi için spesifik bir hisse kodu veya strateji adı belirtebilirsiniz. Örneğin 'THYAO analiz et' veya 'strateji öner' diyebilirsiniz."
        }
        return ChatMessage(
            id = "ai_${System.currentTimeMillis()}",
            content = response,
            isUser = false,
            timestamp = System.currentTimeMillis()
        )
    }

    // Workaround for KMP - get current time millis
    private object System {
        fun currentTimeMillis(): Long = kotlinx.datetime.Clock.System.now().toEpochMilliseconds()
    }
}
