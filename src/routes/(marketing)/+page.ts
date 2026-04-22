import { redirect } from '@sveltejs/kit'
import '../../app.css'

export const ssr = true
export const prerender = false
export const csr = true

export const load = () => {
    throw redirect(303, '/library/tracks')
}
