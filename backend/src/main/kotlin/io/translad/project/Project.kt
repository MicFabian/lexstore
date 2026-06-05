package io.translad.project

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "project")
class Project(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false, unique = true)
    var code: String,

    @Column(name = "source_lang", nullable = false)
    var sourceLang: String = "en",

    @Column(nullable = false)
    var mark: String = "#3a5bff",

    @Column(name = "updated_label")
    var updatedLabel: String? = null,
)
