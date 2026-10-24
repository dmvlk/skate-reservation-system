export type CategoryCode = 'skates' | 'skis' | 'snowboard'
export interface Category {
  id: number
  code: string
  name: string
}
export interface ItemType {
  id: number
  code: string
  name: string
  is_required: boolean
  size_options: { id: number; code: string }[]
}
export interface Availability {
  category: string
  days: { date: string; available_hours: number[] }[]
}
export interface BookingCreate {
  category: CategoryCode
  phone: string
  last_name: string
  first_name: string
  middle_name?: string | null
  booking_date: string
  hours: number[]
  size_value?: number
  size_bucket?: string
  boot_size_value?: number
}
export interface BookingReceipt {
  id: number
  phone_last4: string
  category: string
  booking_date: string
  hours: number[]
  status: string
}
export interface MyBooking {
  id: number
  category: string
  booking_date: string | null
  hours: number[]
  status: string
  items: { item_type: string; size: string | null }[]
}
export interface AdminBooking {
  id: number
  phone: string
  full_name: string
  category: string
  booking_date: string | null
  hours: number[]
  status: string
  items: string[]
}
export interface InventoryItem {
  id: number
  item_type: string
  size: string | null
  status: string
  code: string
}
export interface InventoryCreate {
  item_type_code: string
  size_value?: number
  size_bucket?: string
}
export interface Admin {
  id: number
  username: string
  last_name: string
  first_name: string
  middle_name: string | null
}
export interface LoginResult {
  access_token: string
  token_type: string
  username: string
  full_name: string
}
export interface ActionResult {
  id: number
  status: string
  message: string
}
