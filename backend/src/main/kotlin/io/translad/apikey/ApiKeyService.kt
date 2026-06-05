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
    private val hex = "0123456789abcdef".toCharArray()

    fun list(projectId: UUID): List<ApiKeyView> =
        keys.findByProjectIdOrderByCreatedLabel(projectId).map(::toView)

    @Transactional
    fun generate(projectId: UUID, req: GenerateApiKeyRequest): ApiKeyCreated {
        val scope = if (req.scope.equals("Read only", ignoreCase = true)) {
            ApiKeyScope.READ_ONLY
        } else {
            ApiKeyScope.READ_WRITE
        }
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
                secret = secret,
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
