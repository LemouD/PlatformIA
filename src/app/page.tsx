import { CommandCenter } from '@/features/command-center/CommandCenter'
import { mockSnapshot } from '@/mocks/snapshot'

export default function CommandCenterPage() {
  return <CommandCenter snapshot={mockSnapshot} />
}
