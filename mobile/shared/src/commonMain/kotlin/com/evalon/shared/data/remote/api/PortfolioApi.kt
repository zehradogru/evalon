package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.domain.model.Portfolio
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.url

class PortfolioApi(private val client: HttpClient) {
    suspend fun getPortfolio(userId: String): Portfolio {
        return client.get(ApiConfig.PORTFOLIO) {
            url {
                parameters.append("userId", userId)
            }
        }.body()
    }
}
