import {
    collection,
    doc,
    type DocumentData,
    type QueryDocumentSnapshot,
    type SnapshotOptions,
    type FirestoreDataConverter,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import type {
    AlertRule,
    NotificationDevice,
    UserNotification,
} from '@/types'

const USERS_COLLECTION = 'users'
const ALERT_RULES_COLLECTION = 'alert_rules'
const NOTIFICATIONS_COLLECTION = 'notifications'
const NOTIFICATION_DEVICES_COLLECTION = 'notification_devices'

function createConverter<T extends DocumentData>(): FirestoreDataConverter<T> {
    return {
        toFirestore(value: T) {
            return value
        },
        fromFirestore(
            snapshot: QueryDocumentSnapshot<DocumentData>,
            options: SnapshotOptions
        ) {
            return snapshot.data(options) as T
        },
    }
}

const alertRuleConverter = createConverter<Omit<AlertRule, 'id'>>()
const notificationConverter = createConverter<Omit<UserNotification, 'id'>>()
const notificationDeviceConverter = createConverter<Omit<NotificationDevice, 'id'>>()

export function userDoc(uid: string) {
    return doc(db, USERS_COLLECTION, uid)
}

export function userAlertRulesCollection(uid: string) {
    return collection(db, USERS_COLLECTION, uid, ALERT_RULES_COLLECTION).withConverter(
        alertRuleConverter
    )
}

export function userAlertRuleDoc(uid: string, ruleId: string) {
    return doc(db, USERS_COLLECTION, uid, ALERT_RULES_COLLECTION, ruleId).withConverter(
        alertRuleConverter
    )
}

export function userNotificationsCollection(uid: string) {
    return collection(db, USERS_COLLECTION, uid, NOTIFICATIONS_COLLECTION).withConverter(
        notificationConverter
    )
}

export function userNotificationDoc(uid: string, notificationId: string) {
    return doc(
        db,
        USERS_COLLECTION,
        uid,
        NOTIFICATIONS_COLLECTION,
        notificationId
    ).withConverter(notificationConverter)
}

export function userNotificationDevicesCollection(uid: string) {
    return collection(
        db,
        USERS_COLLECTION,
        uid,
        NOTIFICATION_DEVICES_COLLECTION
    ).withConverter(notificationDeviceConverter)
}

export function userNotificationDeviceDoc(uid: string, deviceId: string) {
    return doc(
        db,
        USERS_COLLECTION,
        uid,
        NOTIFICATION_DEVICES_COLLECTION,
        deviceId
    ).withConverter(notificationDeviceConverter)
}
