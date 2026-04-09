'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Bell, Moon, Sun, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select-native'
import { Button } from '@/components/ui/button'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import type { AppCurrency, AppLanguage, AppTheme, UserPreferences } from '@/types'

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
        priceAlerts: true,
        newsDigest: false,
    },
}

function SettingsForm({
    isWidget,
    initialPreferences,
    isProfileLoading,
}: SettingsFormProps) {
    const updatePreferencesMutation = useUpdatePreferences()
    const [language, setLanguage] = useState<AppLanguage>(
        initialPreferences.language
    )
    const [currency, setCurrency] = useState<AppCurrency>(
        initialPreferences.currency
    )
    const [theme, setTheme] = useState<AppTheme>(initialPreferences.theme)
    const [priceAlerts, setPriceAlerts] = useState(
        initialPreferences.notifications.priceAlerts
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

    const hasChanges =
        language !== initialPreferences.language ||
        currency !== initialPreferences.currency ||
        theme !== initialPreferences.theme ||
        priceAlerts !== initialPreferences.notifications.priceAlerts ||
        newsDigest !== initialPreferences.notifications.newsDigest

    const handleSaveSettings = async () => {
        setFeedback(null)
        try {
            await updatePreferencesMutation.mutateAsync({
                language,
                currency,
                theme,
                notifications: {
                    priceAlerts,
                    newsDigest,
                },
            })
            setFeedback({
                type: 'success',
                message: 'Settings saved successfully.',
            })
        } catch (error) {
            setFeedback({
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to save settings.',
            })
        }
    }

    return (
        <div
            className={cn(
                'flex flex-col gap-6',
                isWidget ? 'p-4' : 'p-6 max-w-4xl mx-auto'
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
                <div className="flex flex-col gap-2 mb-2">
                    <h1 className="text-xl font-bold tracking-tight">Settings</h1>
                </div>
            )}

            <div className={cn('grid gap-6', isWidget ? 'gap-4' : '')}>
                <Card className={cn('bg-card border-border', isWidget ? 'p-4' : 'p-6')}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
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
                                    <div className="text-sm text-muted-foreground">
                                        Select your preferred language
                                    </div>
                                )}
                            </div>
                            <Select
                                value={language}
                                onChange={(e) =>
                                    setLanguage(e.target.value as AppLanguage)
                                }
                                disabled={controlsDisabled}
                                className="bg-background border border-border rounded-md h-9 px-3 text-sm w-full md:w-auto"
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
                                    <div className="text-sm text-muted-foreground">
                                        Default currency for display
                                    </div>
                                )}
                            </div>
                            <Select
                                value={currency}
                                onChange={(e) =>
                                    setCurrency(e.target.value as AppCurrency)
                                }
                                disabled={controlsDisabled}
                                className="bg-background border border-border rounded-md h-9 px-3 text-sm w-full md:w-auto"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="TRY">TRY (₺)</option>
                                <option value="EUR">EUR (€)</option>
                            </Select>
                        </div>
                    </div>
                </Card>

                <Card className={cn('bg-card border-border', isWidget ? 'p-4' : 'p-6')}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Bell size={20} /> Notifications
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Price Alerts</Label>
                                {!isWidget && (
                                    <div className="text-sm text-muted-foreground">
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
                                <Label>News Digest</Label>
                                {!isWidget && (
                                    <div className="text-sm text-muted-foreground">
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
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Moon size={20} /> Appearance
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Theme</Label>
                                {!isWidget && (
                                    <div className="text-sm text-muted-foreground">
                                        Select application theme
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center bg-secondary rounded-full p-1 border border-border">
                                <button
                                    type="button"
                                    disabled={controlsDisabled}
                                    onClick={() => setTheme('dark')}
                                    className={cn(
                                        'p-1.5 rounded-full transition-colors',
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
                                        'p-1.5 rounded-full transition-colors',
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

                {!isWidget && (
                    <div className="flex items-center justify-between gap-4">
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
                        >
                            {isSaving ? 'Saving...' : 'Save Preferences'}
                        </Button>
                    </div>
                )}
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
