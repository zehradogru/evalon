'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Bell, Moon, Sun, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select-native'
import { Button } from '@/components/ui/button'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import type {
  AppCurrency,
  AppLanguage,
  AppTheme,
  UserPreferences,
} from '@/types'

interface SettingsViewProps {
  isWidget?: boolean
}

interface SettingsFormProps {
  isWidget: boolean
  initialPreferences: UserPreferences
  isProfileLoading: boolean
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  currency: 'USD',
  theme: 'dark',
  notifications: {
    pushEnabled: false,
    priceAlerts: true,
    indicatorAlerts: true,
    newsAlerts: false,
    newsDigest: false,
  },
}

function SettingsForm({
  isWidget,
  initialPreferences,
  isProfileLoading,
}: SettingsFormProps) {
  const updatePreferencesMutation = useUpdatePreferences()
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savedPreferences, setSavedPreferences] =
    useState<UserPreferences>(initialPreferences)
  const [language, setLanguage] = useState<AppLanguage>(
    initialPreferences.language
  )
  const [currency, setCurrency] = useState<AppCurrency>(
    initialPreferences.currency
  )
  const [theme, setTheme] = useState<AppTheme>(initialPreferences.theme)
  const [pushEnabled, setPushEnabled] = useState(
    initialPreferences.notifications.pushEnabled
  )
  const [priceAlerts, setPriceAlerts] = useState(
    initialPreferences.notifications.priceAlerts
  )
  const [indicatorAlerts, setIndicatorAlerts] = useState(
    initialPreferences.notifications.indicatorAlerts
  )
  const [newsAlerts, setNewsAlerts] = useState(
    initialPreferences.notifications.newsAlerts
  )
  const [newsDigest, setNewsDigest] = useState(
    initialPreferences.notifications.newsDigest
  )
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const isSaving = updatePreferencesMutation.isPending
  const controlsDisabled = isProfileLoading || isSaving

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current)
      }
    }
  }, [])

  const hasChanges =
    language !== savedPreferences.language ||
    currency !== savedPreferences.currency ||
    theme !== savedPreferences.theme ||
    pushEnabled !== savedPreferences.notifications.pushEnabled ||
    priceAlerts !== savedPreferences.notifications.priceAlerts ||
    indicatorAlerts !== savedPreferences.notifications.indicatorAlerts ||
    newsAlerts !== savedPreferences.notifications.newsAlerts ||
    newsDigest !== savedPreferences.notifications.newsDigest

  const handleSaveSettings = async () => {
    setFeedback(null)
    const nextPreferences: UserPreferences = {
      language,
      currency,
      theme,
      notifications: {
        pushEnabled,
        priceAlerts,
        indicatorAlerts,
        newsAlerts,
        newsDigest,
      },
    }

    try {
      await updatePreferencesMutation.mutateAsync(nextPreferences)
      setSavedPreferences(nextPreferences)
      setFeedback({
        type: 'success',
        message: 'Kaydedildi ✓',
      })
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current)
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null)
      }, 1500)
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to save settings.',
      })
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-6',
        isWidget && 'h-full',
        isWidget ? 'p-4' : 'mx-auto max-w-4xl p-6'
      )}
    >
      {!isWidget && (
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure application preferences and notifications.
          </p>
        </div>
      )}

      {isWidget && (
        <div className="mb-2 flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        </div>
      )}

      <div
        className={cn(
          'grid gap-6',
          isWidget ? 'flex-1 gap-4 overflow-y-auto pb-4' : ''
        )}
      >
        <Card className={cn('bg-card border-border', isWidget ? 'p-4' : 'p-6')}>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Globe size={20} /> General
          </h3>
          <div className="space-y-4">
            <div
              className={cn(
                'flex justify-between',
                isWidget ? 'flex-col items-start gap-2' : 'items-center'
              )}
            >
              <div className="space-y-0.5">
                <Label>Language</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Select your preferred language
                  </div>
                )}
              </div>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                disabled={controlsDisabled}
                className="bg-background border-border h-9 w-full rounded-md border px-3 text-sm md:w-auto"
              >
                <option value="en">English</option>
                <option value="tr">Turkish</option>
                <option value="de">German</option>
              </Select>
            </div>
            <div
              className={cn(
                'flex justify-between',
                isWidget ? 'flex-col items-start gap-2' : 'items-center'
              )}
            >
              <div className="space-y-0.5">
                <Label>Currency</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Default currency for display
                  </div>
                )}
              </div>
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as AppCurrency)}
                disabled={controlsDisabled}
                className="bg-background border-border h-9 w-full rounded-md border px-3 text-sm md:w-auto"
              >
                <option value="USD">USD ($)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="EUR">EUR (€)</option>
              </Select>
            </div>
          </div>
        </Card>

        <Card className={cn('bg-card border-border', isWidget ? 'p-4' : 'p-6')}>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Bell size={20} /> Notifications
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Allow browser push delivery for notification rules
                  </div>
                )}
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={setPushEnabled}
                disabled={controlsDisabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Price Alerts</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Receive notifications for price targets
                  </div>
                )}
              </div>
              <Switch
                checked={priceAlerts}
                onCheckedChange={setPriceAlerts}
                disabled={controlsDisabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Indicator Alerts</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Include indicator and crossover rule notifications
                  </div>
                )}
              </div>
              <Switch
                checked={indicatorAlerts}
                onCheckedChange={setIndicatorAlerts}
                disabled={controlsDisabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Watchlist News Alerts</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Deliver grouped watchlist news notifications to inbox and
                    browser push
                  </div>
                )}
              </div>
              <Switch
                checked={newsAlerts}
                onCheckedChange={setNewsAlerts}
                disabled={controlsDisabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>News Digest</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Daily summary of market news
                  </div>
                )}
              </div>
              <Switch
                checked={newsDigest}
                onCheckedChange={setNewsDigest}
                disabled={controlsDisabled}
              />
            </div>
          </div>
        </Card>

        <Card className={cn('bg-card border-border', isWidget ? 'p-4' : 'p-6')}>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Moon size={20} /> Appearance
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                {!isWidget && (
                  <div className="text-muted-foreground text-sm">
                    Select application theme
                  </div>
                )}
              </div>
              <div className="bg-secondary border-border flex items-center rounded-full border p-1">
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'rounded-full p-1.5 transition-colors',
                    theme === 'dark'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Moon size={16} />
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => setTheme('light')}
                  className={cn(
                    'rounded-full p-1.5 transition-colors',
                    theme === 'light'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Sun size={16} />
                </button>
              </div>
            </div>
          </div>
        </Card>

        <div
          className={cn(
            'flex items-center justify-between gap-4',
            isWidget &&
              'bg-card/95 border-border sticky bottom-0 z-10 -mx-4 -mb-4 border-t p-4 backdrop-blur'
          )}
        >
          <div className="text-sm">
            {feedback?.type === 'success' && (
              <span className="text-chart-2">{feedback.message}</span>
            )}
            {feedback?.type === 'error' && (
              <span className="text-destructive">{feedback.message}</span>
            )}
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={controlsDisabled || !hasChanges}
            className={cn(isWidget && 'min-w-28')}
          >
            {isSaving
              ? 'Kaydediliyor...'
              : isWidget
                ? 'Kaydet'
                : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SettingsView({ isWidget = false }: SettingsViewProps) {
  const { data: profile, isLoading } = useProfile()
  const initialPreferences = profile?.preferences || DEFAULT_PREFERENCES
  const profileKey = `${profile?.uid || 'anonymous'}-${profile?.updatedAt || 'initial'}`

  return (
    <SettingsForm
      key={profileKey}
      isWidget={isWidget}
      initialPreferences={initialPreferences}
      isProfileLoading={isLoading && !profile}
    />
  )
}
