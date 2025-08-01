'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Facebook, Users, CheckCircle, Circle } from 'lucide-react'

export interface FacebookPage {
  id: string
  name: string
  access_token?: string
  category?: string
  is_active?: boolean
  followers_count?: number
  likes_count?: number
  about?: string
  cover_photo?: string
  profile_picture?: string
}

interface FacebookPageSelectorProps {
  pages: FacebookPage[]
  selectedPageIds: string[]
  onSelectionChange: (selectedPageIds: string[]) => void
  className?: string
  loading?: boolean
  disabled?: boolean
  title?: string
  description?: string
  showSelectAll?: boolean
  maxSelections?: number
}

export function FacebookPageSelector({
  pages,
  selectedPageIds,
  onSelectionChange,
  className = '',
  loading = false,
  disabled = false,
  title = 'Selecionar Páginas do Facebook',
  description = 'Escolha as páginas onde deseja publicar seu conteúdo',
  showSelectAll = true,
  maxSelections
}: FacebookPageSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter pages based on search term
  const filteredPages = pages.filter(page =>
    page.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handlePageToggle = (pageId: string) => {
    if (disabled) return

    const isSelected = selectedPageIds.includes(pageId)
    let newSelection: string[]

    if (isSelected) {
      // Remove from selection
      newSelection = selectedPageIds.filter(id => id !== pageId)
    } else {
      // Add to selection (check max limit)
      if (maxSelections && selectedPageIds.length >= maxSelections) {
        return // Don't add if max limit reached
      }
      newSelection = [...selectedPageIds, pageId]
    }

    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    if (disabled) return

    if (selectedPageIds.length === filteredPages.length) {
      // Deselect all
      onSelectionChange([])
    } else {
      // Select all (respecting max limit)
      const pagesToSelect = maxSelections 
        ? filteredPages.slice(0, maxSelections).map(page => page.id)
        : filteredPages.map(page => page.id)
      onSelectionChange(pagesToSelect)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return num.toLocaleString('pt-BR')
  }

  const isAllSelected = filteredPages.length > 0 && selectedPageIds.length === filteredPages.length
  const isSomeSelected = selectedPageIds.length > 0 && selectedPageIds.length < filteredPages.length

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-muted-foreground">Carregando páginas...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (pages.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Facebook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Nenhuma página encontrada
            </h3>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do Facebook para ver suas páginas
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {selectedPageIds.length} / {pages.length} selecionadas
          </Badge>
        </div>
        
        {/* Search and Select All */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar páginas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              disabled={disabled}
            />
          </div>
          {showSelectAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={disabled || filteredPages.length === 0}
              className="flex items-center gap-2"
            >
              {isAllSelected ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
              {isAllSelected ? 'Desmarcar Todas' : 'Selecionar Todas'}
            </Button>
          )}
        </div>

        {maxSelections && (
          <p className="text-xs text-muted-foreground mt-2">
            Máximo de {maxSelections} páginas podem ser selecionadas
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-80 w-full">
          <div className="space-y-3">
            {filteredPages.map((page) => {
              const isSelected = selectedPageIds.includes(page.id)
              const isMaxReached = maxSelections && selectedPageIds.length >= maxSelections && !isSelected

              return (
                <div
                  key={page.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                      : 'bg-card hover:bg-muted/50'
                  } ${
                    disabled || isMaxReached ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  onClick={() => !disabled && !isMaxReached && handlePageToggle(page.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handlePageToggle(page.id)}
                    disabled={disabled || isMaxReached}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground truncate">
                        {page.name}
                      </h4>
                      {page.is_active !== undefined && (
                        <Badge 
                          variant={page.is_active ? "default" : "secondary"}
                          className="ml-2 text-xs"
                        >
                          {page.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        ID: {page.id}
                      </span>
                      {page.category && (
                        <Badge variant="outline" className="text-xs">
                          {page.category}
                        </Badge>
                      )}
                    </div>

                    {/* Page Stats */}
                    {(page.followers_count || page.likes_count) && (
                      <div className="flex items-center gap-4 mt-2">
                        {page.likes_count && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Facebook className="w-3 h-3" />
                            <span>{formatNumber(page.likes_count)} curtidas</span>
                          </div>
                        )}
                        {page.followers_count && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{formatNumber(page.followers_count)} seguidores</span>
                          </div>
                        )}
                      </div>
                    )}

                    {page.about && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {page.about}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {filteredPages.length === 0 && searchTerm && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Nenhuma página encontrada para "{searchTerm}"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}