'use client'

import CantieriSchedaPanel from './CantieriSchedaPanel'
import CantieriAnalisiDocumentoPanel from './CantieriAnalisiDocumentoPanel'
import CantieriEconomiaPanel from './CantieriEconomiaPanel'

type CantieriContainerProps = any

export default function CantieriContainer(props: CantieriContainerProps) {
  return (
    <>
      <CantieriSchedaPanel {...props} />
      <CantieriAnalisiDocumentoPanel {...props} />
      <CantieriEconomiaPanel {...props} />
    </>
  )
}