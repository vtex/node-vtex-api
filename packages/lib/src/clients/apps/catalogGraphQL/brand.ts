export const query = `
query GetBrand($id: ID!) {
  brand (id: $id) {
    id
    name
    text
    keywords
    siteTitle
    active
    menuHome
    adWordsRemarketingCode
    lomadeeCampaignCode
    score
  }
}
`

export interface Brand {
  id: string
  name: string
  text?: string
  keywords?: string[]
  siteTitle?: string
  active: boolean
  menuHome: boolean
  adWordsRemarketingCode?: string
  lomadeeCampaignCode?: string
  score?: number
}
