// Ruta heredada: la canónica es /recepcion. Se mantiene como redirección.
import { redirect } from 'next/navigation'

export default function ReceptionRedirectPage() {
  redirect('/recepcion')
}
