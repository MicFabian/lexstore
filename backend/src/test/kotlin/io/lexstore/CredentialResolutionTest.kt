package io.lexstore

import io.lexstore.org.AiCredential
import io.lexstore.org.AiCredentialRepository
import io.lexstore.org.CredentialResolver
import io.lexstore.org.CredentialSource
import io.lexstore.org.OrganisationRepository
import io.lexstore.org.SecretCipher
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.TestPropertySource
import java.util.UUID

private val MOSAIC_WEB = UUID.fromString("35f54c71-131a-cc6e-aad2-f22b0eca789f")
private val MOSAIC_IOS = UUID.fromString("c300efad-b80f-b593-8161-2da008e1a041")

@TestPropertySource(properties = ["lexstore.secret-key=test-master-secret"])
class CredentialResolutionTest : IntegrationTestBase() {

    @Autowired private lateinit var resolver: CredentialResolver
    @Autowired private lateinit var credentials: AiCredentialRepository
    @Autowired private lateinit var organisations: OrganisationRepository
    @Autowired private lateinit var cipher: SecretCipher

    private fun orgId(): UUID = organisations.findAll().first().id

    @Test
    fun `a project key overrides its organisation for that project only`() {
        credentials.save(
            AiCredential(
                orgId = orgId(),
                provider = "claude",
                secretCipher = cipher.encrypt("org-key"),
                tail = "-key",
            ),
        )
        credentials.save(
            AiCredential(
                projectId = MOSAIC_WEB,
                provider = "claude",
                secretCipher = cipher.encrypt("project-key"),
                tail = "-key",
            ),
        )

        val overridden = resolver.resolve(MOSAIC_WEB, "claude")
        assertThat(overridden?.apiKey).isEqualTo("project-key")
        assertThat(overridden?.source).isEqualTo(CredentialSource.PROJECT)

        // A sibling project keeps the organisation's key.
        val sibling = resolver.resolve(MOSAIC_IOS, "claude")
        assertThat(sibling?.apiKey).isEqualTo("org-key")
        assertThat(sibling?.source).isEqualTo(CredentialSource.ORGANISATION)
    }

    @Test
    fun `a stored key is unreadable without the master secret`() {
        val stored = cipher.encrypt("sk-ant-secret-value")
        assertThat(stored).doesNotContain("sk-ant")
        assertThat(cipher.decrypt(stored)).isEqualTo("sk-ant-secret-value")
    }
}
