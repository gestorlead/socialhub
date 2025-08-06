import { NetworkConfig } from '@/components/ui/multi-network-selector'

export const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    colors: 'from-purple-500 to-pink-500',
    iconPath: '/images/social-icons/instagram-rounded-icon.png',
    iconDisabledPath: '/images/social-icons/instagram-rounded-icon-disabled.png',
    connectPath: '/networks/instagram',
    options: [
      {
        id: 'instagram_feed',
        name: 'Instagram Feed',
        shortName: 'Feed',
        description: 'Post principal no feed do Instagram',
        mediaTypes: ['image', 'video', 'carousel'],
        maxFiles: 10,
        requirements: ['Imagens: JPEG, PNG', 'Vídeos: MP4, MOV', 'Até 10 itens em carrossel']
      },
      {
        id: 'instagram_story',
        name: 'Instagram Stories',
        shortName: 'Story',
        icon: '/images/social-icons/instagram-story-rounded-icon.png',
        iconDisabled: '/images/social-icons/instagram-story-rounded-icon-disabled.png',
        description: 'Story temporário (24h)',
        mediaTypes: ['image', 'video'],
        maxFiles: 1,
        requirements: ['Formato vertical recomendado 9:16', 'Até 15 segundos para vídeo']
      },
      {
        id: 'instagram_reels',
        name: 'Instagram Reels',
        shortName: 'Reel',
        icon: '/images/social-icons/instagram-reels.svg',
        iconDisabled: '/images/social-icons/instagram-reels-rounded-icon-disabled.svg',
        description: 'Vídeo vertical curto',
        mediaTypes: ['video'],
        maxFiles: 1,
        requirements: ['Vídeo vertical', 'Entre 3 e 90 segundos', 'MP4 recomendado']
      }
    ]
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    colors: 'from-pink-500 to-rose-600',
    iconPath: '/images/social-icons/tiktok-business.svg',
    iconDisabledPath: '/images/social-icons/tiktok-business-icon-disabled.svg',
    connectPath: '/networks/tiktok',
    options: [
      {
        id: 'tiktok_video',
        name: 'TikTok Video',
        shortName: 'Video',
        description: 'Vídeo principal do TikTok',
        mediaTypes: ['video'],
        maxFiles: 1,
        requirements: ['Vídeo vertical', 'Entre 3 segundos e 10 minutos', 'MP4 recomendado']
      }
    ]
  },
  {
    id: 'youtube',
    name: 'YouTube',
    colors: 'from-red-500 to-red-600',
    iconPath: '/images/social-icons/youtube-rounded-icon.svg',
    iconDisabledPath: '/images/social-icons/youtube-rounded-icon-disabled.svg',
    connectPath: '/networks/youtube',
    options: [
      {
        id: 'youtube_video',
        name: 'YouTube Video',
        shortName: 'Video',
        description: 'Vídeo horizontal tradicional',
        mediaTypes: ['video'],
        maxFiles: 1,
        requirements: ['Vídeo horizontal 16:9', 'Até 12 horas de duração', 'MP4 recomendado']
      },
      {
        id: 'youtube_shorts',
        name: 'YouTube Shorts',
        shortName: 'Short',
        icon: '/images/social-icons/youtube-shorts-rounded-icon.svg',
        iconDisabled: '/images/social-icons/youtube-shorts-rounded-icon-disabled.svg',
        description: 'Vídeo vertical curto',
        mediaTypes: ['video'],
        maxFiles: 1,
        requirements: ['Vídeo vertical 9:16', 'Até 60 segundos', 'MP4 recomendado']
      }
    ]
  },
  {
    id: 'facebook',
    name: 'Facebook',
    colors: 'from-blue-500 to-blue-600',
    iconPath: '/images/social-icons/facebook-rounded-icon.svg',
    iconDisabledPath: '/images/social-icons/facebook-rounded-icon-disabled.svg',
    connectPath: '/networks/facebook',
    options: [
      {
        id: 'facebook_post',
        name: 'Facebook Post',
        shortName: 'Post',
        description: 'Post principal no Facebook',
        mediaTypes: ['image', 'video', 'carousel'],
        maxFiles: 10,
        requirements: ['Imagens: JPEG, PNG', 'Vídeos: MP4, MOV', 'Até 10 itens']
      },
      {
        id: 'facebook_story',
        name: 'Facebook Stories',
        shortName: 'Story',
        icon: '/images/social-icons/facebook-story-rounded-icon.png',
        iconDisabled: '/images/social-icons/facebook-story-rounded-icon-disabled.png',
        description: 'Story temporário no Facebook',
        mediaTypes: ['image', 'video'],
        maxFiles: 1,
        requirements: ['Formato vertical recomendado', 'Story temporário 24h']
      },
      {
        id: 'facebook_reels',
        name: 'Facebook Reels',
        shortName: 'Reel',
        icon: '/images/social-icons/facebook-reels.svg',
        iconDisabled: '/images/social-icons/facebook-reels-rounded-icon-disabled.png',
        description: 'Vídeo curto do Facebook',
        mediaTypes: ['video'],
        maxFiles: 1,
        requirements: ['Vídeo vertical', 'Entre 3 e 90 segundos']
      }
    ]
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    colors: 'from-blue-600 to-blue-700',
    iconPath: '/images/social-icons/linkedin-rounded-icon.svg',
    iconDisabledPath: '/images/social-icons/linkedin-rounded-icon-disabled.svg',
    connectPath: '/networks/linkedin',
    options: [
      {
        id: 'linkedin_post',
        name: 'LinkedIn Post',
        shortName: 'Post',
        description: 'Post profissional no LinkedIn',
        mediaTypes: ['image', 'video', 'carousel'],
        maxFiles: 9,
        requirements: ['Conteúdo profissional', 'Imagens: JPEG, PNG', 'Vídeos: MP4']
      },
      {
        id: 'linkedin_article',
        name: 'LinkedIn Article',
        shortName: 'Artigo',
        description: 'Artigo longo no LinkedIn',
        mediaTypes: ['image'],
        maxFiles: 1,
        requirements: ['Conteúdo editorial', 'Formato de artigo longo']
      }
    ]
  },
  {
    id: 'threads',
    name: 'Threads',
    colors: 'from-gray-800 to-black',
    iconPath: '/images/social-icons/threads-icon.svg',
    iconDisabledPath: '/images/social-icons/threads-icon-disabled.svg',
    connectPath: '/networks/threads',
    options: [
      {
        id: 'threads_post',
        name: 'Threads Post',
        shortName: 'Post',
        description: 'Post no Threads',
        mediaTypes: ['image', 'video'],
        maxFiles: 10,
        requirements: ['Até 500 caracteres', 'Até 10 imagens ou 1 vídeo']
      }
    ]
  },
  {
    id: 'x',
    name: 'X',
    colors: 'from-gray-900 to-black',
    iconPath: '/images/social-icons/x_icon.png',
    iconDisabledPath: '/images/social-icons/x_icon_disabled.svg',
    connectPath: '/networks/x',
    options: [
      {
        id: 'x_post',
        name: 'X Post',
        shortName: 'Post',
        description: 'Post no X (Twitter)',
        mediaTypes: ['image', 'video'],
        maxFiles: 4,
        requirements: ['Até 280 caracteres', 'Até 4 imagens ou 1 vídeo']
      }
    ]
  }
]

// Função helper para encontrar uma opção específica
export const findNetworkOption = (optionId: string) => {
  for (const network of NETWORK_CONFIGS) {
    const option = network.options.find(opt => opt.id === optionId)
    if (option) {
      return { network, option }
    }
  }
  return null
}

// Função helper para obter opções de uma rede específica
export const getNetworkOptions = (networkId: string) => {
  return NETWORK_CONFIGS.find(network => network.id === networkId)?.options || []
}

// Função helper para verificar se uma opção suporta um tipo de mídia
export const optionSupportsMediaType = (optionId: string, mediaType: 'image' | 'video' | 'carousel') => {
  const result = findNetworkOption(optionId)
  return result?.option.mediaTypes.includes(mediaType) || false
}

// Função helper para obter o máximo de arquivos suportados por uma opção
export const getMaxFilesForOption = (optionId: string) => {
  const result = findNetworkOption(optionId)
  return result?.option.maxFiles || 1
}

// Função helper para obter as opções compatíveis com um tipo de mídia
export const getCompatibleOptions = (selectedOptions: string[], mediaType: 'image' | 'video' | 'carousel') => {
  return selectedOptions.filter(optionId => optionSupportsMediaType(optionId, mediaType))
}
