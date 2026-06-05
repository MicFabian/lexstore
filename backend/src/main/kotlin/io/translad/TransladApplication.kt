package io.translad

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class TransladApplication

fun main(args: Array<String>) {
    runApplication<TransladApplication>(*args)
}
