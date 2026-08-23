package io.lexstore.org

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "organisation")
class Organisation(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false, unique = true)
    var slug: String,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    /** Null when the organisation translates with its own provider key. */
    @Column(name = "agent_plan")
    var agentPlan: String? = null,

    @Column(name = "agent_monthly_quota", nullable = false)
    var agentMonthlyQuota: Long = 0,

    @Column(name = "agent_used_this_period", nullable = false)
    var agentUsedThisPeriod: Long = 0,

    @Column(name = "agent_period_start", nullable = false)
    var agentPeriodStart: Instant = Instant.now(),
)

@Entity
@Table(name = "org_member")
class OrgMember(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "org_id", nullable = false)
    val orgId: UUID,

    @Column(nullable = false)
    var email: String,

    @Column(nullable = false)
    var name: String,

    /** ADMIN configures the organisation; MEMBER works in its projects. */
    @Column(nullable = false)
    var role: String = "MEMBER",
)

interface OrganisationRepository : JpaRepository<Organisation, UUID> {
    fun findBySlug(slug: String): Organisation?
}

interface OrgMemberRepository : JpaRepository<OrgMember, UUID> {
    fun findByOrgIdOrderByName(orgId: UUID): List<OrgMember>
    fun findByEmailIgnoreCase(email: String): List<OrgMember>
    fun findByOrgIdAndEmailIgnoreCase(orgId: UUID, email: String): OrgMember?
}
