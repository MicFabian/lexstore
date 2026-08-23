package io.lexstore.org

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class SecretUnavailableException(message: String) : RuntimeException(message)

/**
 * Encrypts provider keys before they reach the database.
 *
 * A stored key is a live credential someone can spend money with, so the
 * database must not be enough to read it: the master secret lives in the
 * environment, and a database or backup copy alone yields only ciphertext.
 */
@Component
class SecretCipher(
    @Value("\${lexstore.secret-key:}") private val masterSecret: String,
) {
    private val rng = SecureRandom()

    val configured: Boolean get() = masterSecret.isNotBlank()

    fun encrypt(plaintext: String): String {
        val iv = ByteArray(IV_BYTES).also(rng::nextBytes)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.ENCRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, iv))
        }
        val encrypted = cipher.doFinal(plaintext.toByteArray())
        return Base64.getEncoder().encodeToString(iv + encrypted)
    }

    fun decrypt(stored: String): String {
        val raw = Base64.getDecoder().decode(stored)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(
                Cipher.DECRYPT_MODE,
                key(),
                GCMParameterSpec(TAG_BITS, raw.copyOfRange(0, IV_BYTES)),
            )
        }
        return String(cipher.doFinal(raw.copyOfRange(IV_BYTES, raw.size)))
    }

    private fun key(): SecretKeySpec {
        if (!configured) {
            throw SecretUnavailableException(
                "No encryption key is configured, so provider keys cannot be stored. " +
                    "Set LEXSTORE_SECRET_KEY.",
            )
        }
        val digest = MessageDigest.getInstance("SHA-256").digest(masterSecret.toByteArray())
        return SecretKeySpec(digest, "AES")
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val TAG_BITS = 128
    }
}
