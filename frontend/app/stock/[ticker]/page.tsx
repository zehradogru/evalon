import { redirect } from 'next/navigation'

export default async function StockPage({
    params,
}: {
    params: Promise<{ ticker: string }>
}) {
    const { ticker } = await params
    redirect(`/markets/${ticker.toUpperCase()}`)
}
