export const siteConfig = {
  name: 'EVALON',
  description: 'Yapay Zeka Destekli Algoritmik İşlem ve Davranışsal Analiz Platformu',
  url: 'https://evalon.com',
  markets: ['BIST', 'NASDAQ', 'FOREX', 'CRYPTO'],
  theme: {
    primary: '#2962FF',
    background: {
      primary: '#131722',
      secondary: '#1E222D',
      tertiary: '#2A2E39',
    },
    text: {
      primary: '#D1D4DC',
      secondary: '#787B86',
      tertiary: '#B2B5BE',
    },
    accent: {
      blue: '#2962FF',
      green: '#26A69A',
      red: '#EF5350',
    },
  },
}

export type SiteConfig = typeof siteConfig
