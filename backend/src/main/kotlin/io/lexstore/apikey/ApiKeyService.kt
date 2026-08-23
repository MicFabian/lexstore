package io.lexstore.apikey

import io.lexstore.common.ApiKeyScope
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.util.UUID

@Service
@Transactional(readOnly = true)
class ApiKeyService(private val keys: ApiKeyRepository) {

    private val rng = SecureRandom()

    private fun parseScope(raw: String?): ApiKeyScope {
        if (raw.isNullOrBlank()) return ApiKeyScope.READ_WRITE
        val normalized = raw.trim().lowercase()
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

    /** A key for every project the organisation owns, rather than just one. */
    @Transactional
    fun generateForOrg(orgId: UUID, req: GenerateApiKeyRequest): ApiKeyCreated =
        create(projectId = null, orgId = orgId, req = req)

    fun listForOrg(orgId: UUID): List<ApiKeyView> =
        keys.findByOrgId(orgId).map { toView(it).copy(reach = "organisation") }

    @Transactional
    fun revokeForOrg(orgId: UUID, id: UUID) {
        keys.findById(id).ifPresent { if (it.orgId == orgId) keys.delete(it) }
    }

    @Transactional
    fun generate(projectId: UUID, req: GenerateApiKeyRequest): ApiKeyCreated =
        create(projectId = projectId, orgId = null, req = req)

    private fun create(projectId: UUID?, orgId: UUID?, req: GenerateApiKeyRequest): ApiKeyCreated {
        val scope = parseScope(req.scope)
        val prefix = if (req.test) "tl_test_" else "tl_live_"
        val body = randomHex(32)
        val tail = body.takeLast(4)
        val secret = prefix + body
        val saved = keys.save(
            ApiKey(
                projectId = projectId,
                orgId = orgId,
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
        // Derived from the stamp the auth filter writes, so it reflects real
        // use rather than a label fixed when the key was made.
        used = k.lastUsedAt?.let { io.lexstore.common.RelativeTime.format(it) } ?: "Never",
        test = k.prefix.contains("test"),
    )
}
