package io.translad.contributor

import io.translad.common.ContributorRole
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "contributor")
class Contributor(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "project_id", nullable = false)
    val projectId: UUID,

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false)
    var email: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var role: ContributorRole = ContributorRole.TRANSLATOR,

    /** Comma-joined locale codes the contributor is scoped to. */
    @Column(name = "languages", nullable = false)
    var languages: String = "",

    @Column(name = "avatar_index", nullable = false)
    var avatarIndex: Int = 0,

    @Column(name = "last_active", nullable = false)
    var lastActive: String = "",
) {
    val languageList: List<String>
        get() = languages.split(",").map { it.trim() }.filter { it.isNotEmpty() }
}
