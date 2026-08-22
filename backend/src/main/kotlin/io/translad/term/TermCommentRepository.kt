package io.translad.term

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TermCommentRepository : JpaRepository<TermComment, UUID> {
    fun findByTermIdOrderByCreatedAt(termId: UUID): List<TermComment>
    fun findByTermIdInOrderByCreatedAt(termIds: Collection<UUID>): List<TermComment>
}
