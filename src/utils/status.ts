export const statusLabel = (status: number) => {
  if (status >= 500) {
    return 'error'
  }
  if (status >= 200 && status < 300) {
    return 'success'
  }
  return `${Math.floor(status / 100)}xx`
}
