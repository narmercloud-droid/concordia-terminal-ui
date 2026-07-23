export interface TerminalSession {
  branch_id: string
  branch_name: string
  terminal_code: string
  terminal_id: string
  activation_token: string
  isAuthenticated: boolean
}

export interface TerminalActivateResponse {
  branchId: string
  branchName: string
  terminalCode: string
  terminalId: string
  activationToken: string
}
