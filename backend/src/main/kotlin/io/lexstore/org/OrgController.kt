package io.lexstore.org

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/**
 * The organisation a signed-in person belongs to: its plan, its members, the
 * provider keys it stores, and what its AI spend has been used for.
 */
@RestController
@RequestMapping("/api/org")
class OrgController(private val service: OrgService) {

    @GetMapping
    fun current(): OrganisationView = service.current()

    @GetMapping("/members")
    fun members(): List<OrgMemberView> = service.members()

    @GetMapping("/credentials")
    fun credentials(): List<CredentialView> = service.credentials()

    @PostMapping("/credentials")
    @ResponseStatus(HttpStatus.CREATED)
    fun saveCredential(@Valid @RequestBody req: SaveCredentialRequest): CredentialView =
        service.saveCredential(req)

    @DeleteMapping("/credentials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteCredential(@PathVariable id: UUID) = service.deleteCredential(id)

    @PutMapping("/agent")
    fun updateAgentPlan(@RequestBody req: UpdateAgentPlanRequest): OrganisationView =
        service.updateAgentPlan(req)

    @GetMapping("/usage")
    fun usage(@RequestParam(defaultValue = "30") days: Int): UsageSummary = service.usage(days)

    @GetMapping("/activity")
    fun activity(@RequestParam(defaultValue = "50") limit: Int): List<AgentActivityRow> =
        service.activity(limit)
}
