package io.lexstore

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class LexstoreApplication

fun main(args: Array<String>) {
    runApplication<LexstoreApplication>(*args)
}
