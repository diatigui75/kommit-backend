import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APIError } from 'better-auth/api'
import { type AuthRepository, signUp } from '@/services/auth/authService/authService.js'

// Forme relevée dans better-auth 1.7.27 : l'insertion qui échoue sur l'email déjà pris lève ce code-là.
const userCreationFailure = new APIError('UNPROCESSABLE_ENTITY', {
  code: 'FAILED_TO_CREATE_USER',
  message: 'Failed to create user',
})

const signupBody = { name: 'Awa', email: 'awa@example.com', password: 'motdepasse123' }

const repositoryWhereSignUpFails = (emailExists: AuthRepository['emailExists']): AuthRepository => ({
  signUp: vi.fn().mockRejectedValue(userCreationFailure),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  emailExists,
})

describe('double soumission du signup', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('répond EMAIL_ALREADY_EXISTS quand la création échoue et que le compte existe désormais', async () => {
    const repository = repositoryWhereSignUpFails(async () => true)

    const signUpOutcome = await signUp(repository, signupBody, {})

    expect(signUpOutcome).toEqual({
      success: false,
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Un compte avec cet email existe déjà' },
    })
  })

  it('cherche le compte avec l’email de la requête', async () => {
    const emailExists = vi.fn(async () => true)
    const repository = repositoryWhereSignUpFails(emailExists)

    await signUp(repository, signupBody, {})

    expect(emailExists).toHaveBeenCalledWith('awa@example.com')
  })

  it('répond INTERNAL_ERROR quand la création échoue sans qu’aucun compte n’existe', async () => {
    const repository = repositoryWhereSignUpFails(async () => false)

    const signUpOutcome = await signUp(repository, signupBody, {})

    expect(signUpOutcome).toEqual({ success: false, error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) })
  })

  it('répond INTERNAL_ERROR quand la vérification du compte échoue elle aussi', async () => {
    const repository = repositoryWhereSignUpFails(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5432')
    })

    const signUpOutcome = await signUp(repository, signupBody, {})

    expect(signUpOutcome).toEqual({ success: false, error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) })
  })
})
