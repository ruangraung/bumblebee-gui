interface ScanErrorNoticeProps {
  validationError: string | null
  storeError: string | null
}

// One message slot under the form. The form's own validation message outranks
// the store's error, and nothing renders while both are empty.
export function ScanErrorNotice({ validationError, storeError }: ScanErrorNoticeProps) {
  const message = validationError || storeError
  if (!message) return null

  return (
    <div className="whitespace-pre-line rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}
