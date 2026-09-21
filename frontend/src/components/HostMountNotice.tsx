import { useHostMount } from '@/hooks/useHostMount'
import { mountNotice } from '@/lib/hostMount'

const TONES = {
  info: 'mb-3 text-sm text-muted-foreground',
  warning:
    'mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400',
}

// The live state of the host mount, above the root inputs. The paragraph below
// it explains the mechanism; this says what is mounted here and now.
export function HostMountNotice() {
  const notice = mountNotice(useHostMount())
  if (!notice.text) return null

  return <p className={TONES[notice.tone]}>{notice.text}</p>
}
