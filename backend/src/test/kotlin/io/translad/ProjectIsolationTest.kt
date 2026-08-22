package io.translad

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put

private const val MOSAIC_WEB = "35f54c71-131a-cc6e-aad2-f22b0eca789f"
private const val MOSAIC_IOS = "c300efad-b80f-b593-8161-2da008e1a041"

@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
class ProjectIsolationTest : IntegrationTestBase() {

    @Autowired
    private lateinit var mvc: MockMvc

    private fun asGiulia() = jwt().jwt { it.claim("email", "giulia@translad.io") }
        .authorities(org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_PROOFREADER"))

    private fun asPlatformAdmin() = jwt().jwt { it.claim("email", "marcus@translad.io") }
        .authorities(org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))

    @Test
    fun `a member reads the project they belong to`() {
        mvc.get("/api/projects/$MOSAIC_IOS/terms") { with(asGiulia()) }
            .andExpect { status { isOk() } }
    }

    @Test
    fun `a member cannot read a project they do not belong to`() {
        mvc.get("/api/projects/$MOSAIC_WEB/terms") { with(asGiulia()) }
            .andExpect { status { isForbidden() } }
    }

    @Test
    fun `a member cannot write into a project they do not belong to`() {
        mvc.put("/api/projects/$MOSAIC_WEB/languages/de/translations/${java.util.UUID.randomUUID()}") {
            with(asGiulia())
            contentType = MediaType.APPLICATION_JSON
            content = """{"value":"pwned","status":"translated"}"""
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `the project list only contains projects the caller belongs to`() {
        val body = mvc.get("/api/projects") { with(asGiulia()) }
            .andExpect { status { isOk() } }
            .andReturn().response.contentAsString
        assertThat(body).contains(MOSAIC_IOS)
        assertThat(body).doesNotContain(MOSAIC_WEB)
    }

    @Test
    fun `a platform admin still reaches every project`() {
        mvc.get("/api/projects/$MOSAIC_WEB/terms") { with(asPlatformAdmin()) }
            .andExpect { status { isOk() } }
        mvc.get("/api/projects/$MOSAIC_IOS/terms") { with(asPlatformAdmin()) }
            .andExpect { status { isOk() } }
    }
}
