package io.translad.common

/**
 * The project role the caller must hold on the {projectId} in the path.
 * Realm roles say what a person may do somewhere; this says what they may do
 * here, which is the only question a project-scoped route can answer.
 */
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class RequiresProjectRole(vararg val value: ContributorRole)
