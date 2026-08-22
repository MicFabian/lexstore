package io.translad.apikey

import io.translad.common.ApiKeyScope
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.util.UUID

@Service
@Transactional(readOnly = true)
class ApiKeyService(private val keys: ApiKeyRepository) {

    private val rng = SecureRandom()

    private fun parseScope(raw: String?): ApiKeyScope {
        val normalized = raw.orEmpty().trim().lowercase()
            .replace('-', ' ').replace('_', ' ').replace("&", "and")
            .split(" ").filter { it.isNotBlank() }.joinToString(" ")
        return when (normalized) {
            "read only" -> ApiKeyScope.READ_ONLY
            "read write", "read and write" -> ApiKeyScope.READ_WRITE
            else -> throw IllegalArgumentException(
                "Scope must be 'Read only' or 'Read & write'.",
            )
        }
    }

    private fun sha256(value: String): String =
        java.security.MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray())
            .joinToString("") { "%02x".format(it) }
    private val hex = "0123456789abcdef".toCharArray()

    fun list(projectId: UUID): List<ApiKeyView> =
        keys.findByProjectIdOrderByCreatedLabel(projectId).map(::toView)

    @Transactional
    fun generate(projectId: UUID, req: GenerateApiKeyRequest): ApiKeyCreated {
        val scope = parseScope(req.scope)
        val prefix = if (req.test) "tl_test_" else "tl_live_"
        val body = randomHex(32)
        val tail = body.takeLast(4)
        val secret = prefix + body
        val saved = keys.save(
            ApiKey(
                projectId = projectId,
                label = req.label,
                prefix = prefix,
                tail = tail,
                secretHash = sha256(secret),
                scope = scope,
                createdLabel = "Just now",
                lastUsedLabel = "—",
            ),
        )
        return ApiKeyCreated(saved.id, saved.label, secret, scopeLabel(saved.scope))
    }

    @Transactional
    fun revoke(projectId: UUID, id: UUID) {
        keys.findById(id).ifPresent { if (it.projectId == projectId) keys.delete(it) }
    }

    private fun randomHex(len: Int) = buildString { repeat(len) { append(hex[rng.nextInt(16)]) } }

    private fun scopeLabel(s: ApiKeyScope) = if (s == ApiKeyScope.READ_ONLY) "Read only" else "Read & write"

    private fun toView(k: ApiKey) = ApiKeyView(
        id = k.id,
        label = k.label,
        prefix = k.prefix,
        tail = k.tail,
        scope = scopeLabel(k.scope),
        created = k.createdLabel,
        used = k.lastUsedLabel,
        test = k.prefix.contains("test"),
    )
}
