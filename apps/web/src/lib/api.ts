import { createApi } from '@escritorio/core'
import { supabase } from './supabase'

export const api = createApi(supabase)
