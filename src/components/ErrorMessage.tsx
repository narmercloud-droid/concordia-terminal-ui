interface ErrorMessageProps {
  message: string
}

export const ErrorMessage = ({ message }: ErrorMessageProps) => (
  <div className="error-message" role="alert">
    {message}
  </div>
)
