'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/use-auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useProfile,
    useUpdateProfile,
    useUploadProfilePhoto,
} from '@/hooks/use-profile';
import { resolveAvatarUrl } from '@/lib/avatar';
import { User, Mail, Shield, Camera, Loader2 } from 'lucide-react';

export function ProfileView() {
    const { user } = useAuthStore();
    const { data: profile, isLoading } = useProfile();
    const updateProfileMutation = useUpdateProfile();
    const uploadProfilePhotoMutation = useUploadProfilePhoto();
    const [displayName, setDisplayName] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error'
        message: string
    } | null>(null);

    const email = profile?.email || user?.email || '';
    const currentName = profile?.displayName || user?.name || '';
    const plan = profile?.plan || 'Free';
    const avatarUrl = resolveAvatarUrl({
        photoURL: profile?.photoURL || user?.photoURL,
        name: currentName,
        email,
    });
    const isSaving = updateProfileMutation.isPending;
    const isUploadingPhoto = uploadProfilePhotoMutation.isPending;
    const isBusy = isLoading || isSaving || isUploadingPhoto;

    useEffect(() => {
        setDisplayName(currentName);
    }, [currentName]);

    const memberSince = useMemo(() => {
        const dateSource = profile?.createdAt || user?.createdAt;
        if (!dateSource) return '-';

        const parsedDate = new Date(dateSource);
        if (Number.isNaN(parsedDate.getTime())) return '-';

        return parsedDate.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
        });
    }, [profile?.createdAt, user?.createdAt]);

    const hasNameChanged = displayName.trim() !== currentName.trim();
    const isFormValid = displayName.trim().length > 0;

    const handleSaveProfile = async () => {
        setFeedback(null);
        try {
            await updateProfileMutation.mutateAsync({
                displayName: displayName.trim(),
            });
            setFeedback({
                type: 'success',
                message: 'Profile saved successfully.',
            });
        } catch (error) {
            setFeedback({
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to save profile.',
            });
        }
    };

    const handlePhotoSelection = async (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFeedback(null);
        try {
            await uploadProfilePhotoMutation.mutateAsync(file);
            setFeedback({
                type: 'success',
                message: 'Profile photo updated successfully.',
            });
        } catch (error) {
            setFeedback({
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to update profile photo.',
            });
        } finally {
            event.target.value = '';
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
                <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <Card className="p-6 md:col-span-1 bg-card border-border flex flex-col items-center text-center gap-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoSelection}
                        disabled={isBusy}
                        className="hidden"
                    />
                    <div className="relative">
                        <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground overflow-hidden">
                            {avatarUrl ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                                </>
                            ) : (
                                <User size={40} />
                            )}
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload profile photo"
                            className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-background border-input"
                        >
                            {isUploadingPhoto ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Camera size={14} />
                            )}
                        </Button>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{currentName || 'User'}</h2>
                        <p className="text-sm text-muted-foreground">{email}</p>
                    </div>
                    <div className="w-full pt-4 border-t border-border mt-auto">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Plan</span>
                            <span className="font-bold text-primary">{plan}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Member Since</span>
                            <span className="font-medium">{memberSince}</span>
                        </div>
                    </div>
                </Card>

                {/* Edit Form */}
                <Card className="p-6 md:col-span-2 bg-card border-border">
                    <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-3 text-muted-foreground" />
                                    <Input
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        disabled={isBusy}
                                        className="pl-9 bg-background border-border"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-3 text-muted-foreground" />
                                    <Input
                                        value={email}
                                        readOnly
                                        className="pl-9 bg-background border-border opacity-70"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-4">
                            <Label>Password</Label>
                            <Button variant="outline" className="w-full justify-start text-muted-foreground border-border">
                                <Shield size={16} className="mr-2" /> Change Password
                            </Button>
                        </div>

                        <div className="flex items-center justify-between pt-6 gap-4">
                            <div className="text-sm">
                                {feedback?.type === 'success' && (
                                    <span className="text-chart-2">{feedback.message}</span>
                                )}
                                {feedback?.type === 'error' && (
                                    <span className="text-destructive">{feedback.message}</span>
                                )}
                            </div>
                            <Button
                                onClick={handleSaveProfile}
                                disabled={
                                    isBusy ||
                                    !isFormValid ||
                                    !hasNameChanged
                                }
                                className="bg-primary hover:bg-primary/90 text-white"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
