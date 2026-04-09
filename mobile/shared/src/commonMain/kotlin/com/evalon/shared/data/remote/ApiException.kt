package com.evalon.shared.data.remote

sealed class ApiException(message: String) : Exception(message) {
    data class NetworkException(override val message: String) : ApiException(message)
    data class HttpException(val code: Int, override val message: String) : ApiException(message)
    data class SerializationException(override val message: String) : ApiException(message)
    data class UnknownException(override val message: String) : ApiException(message)
}
