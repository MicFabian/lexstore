package io.translad.common

import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.time.Duration

/**
 * Every outbound call gets an explicit deadline: an upstream that stops
 * answering must not hold a servlet thread and its database connection open
 * for the lifetime of the process.
 */
object OutboundHttp {
    private val CONNECT_TIMEOUT: Duration = Duration.ofSeconds(5)
    private val READ_TIMEOUT: Duration = Duration.ofSeconds(30)

    fun client(baseUrl: String): RestClient =
        RestClient.builder()
            .baseUrl(baseUrl)
            .requestFactory(
                SimpleClientHttpRequestFactory().apply {
                    setConnectTimeout(CONNECT_TIMEOUT)
                    setReadTimeout(READ_TIMEOUT)
                },
            )
            .build()
}
