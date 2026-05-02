importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js')

const configUrl = new URL(self.location.href)
const firebaseConfig = {
    apiKey: configUrl.searchParams.get('apiKey') || undefined,
    authDomain: configUrl.searchParams.get('authDomain') || undefined,
    projectId: configUrl.searchParams.get('projectId') || undefined,
    storageBucket: configUrl.searchParams.get('storageBucket') || undefined,
    messagingSenderId:
        configUrl.searchParams.get('messagingSenderId') || undefined,
    appId: configUrl.searchParams.get('appId') || undefined,
    measurementId: configUrl.searchParams.get('measurementId') || undefined,
}

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
    firebase.initializeApp(firebaseConfig)
    const messaging = firebase.messaging()

    messaging.onBackgroundMessage((payload) => {
        const title =
            payload.notification?.title ||
            payload.data?.title ||
            'Notification'
        const body =
            payload.notification?.body ||
            payload.data?.body ||
            'You have a new notification.'
        const url = payload.data?.url || '/notifications'

        self.registration.showNotification(title, {
            body,
            data: {
                url,
            },
            icon: '/favicon.ico',
            badge: '/favicon.ico',
        })
    })
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const targetUrl = event.notification.data?.url || '/notifications'

    event.waitUntil(
        self.clients
            .matchAll({
                type: 'window',
                includeUncontrolled: true,
            })
            .then((clients) => {
                for (const client of clients) {
                    if ('focus' in client && client.url.includes(self.location.origin)) {
                        client.navigate(targetUrl)
                        return client.focus()
                    }
                }

                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl)
                }

                return undefined
            })
    )
})
