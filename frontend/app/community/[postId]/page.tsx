import { DashboardShell } from '@/components/layout/dashboard-shell'
import { PostDetailView } from '@/features/community/post-detail-view'

interface PageProps {
    params: Promise<{ postId: string }>
}

export default async function CommunityPostPage({ params }: PageProps) {
    const { postId } = await params

    return (
        <DashboardShell>
            <PostDetailView postId={postId} />
        </DashboardShell>
    )
}
