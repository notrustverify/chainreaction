import webpush from 'web-push'

const vapidKeys = webpush.generateVAPIDKeys()

console.log('Add these to your .env:\n')
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
console.log(`\nAlso add to the app's .env:`)
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
