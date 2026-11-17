/** Erro com mensagem pensada para mostrar ao utilizador. */
export class UserFacingError extends Error {
  constructor(message: string, public code = "INVALID") {
    super(message);
  }
}
