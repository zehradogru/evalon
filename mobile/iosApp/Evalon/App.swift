import AuthenticationServices
import CryptoKit
import FirebaseAuth
import FirebaseCore
import FirebaseStorage
import GoogleSignIn
import Security
import shared
import SwiftUI
import UIKit

private func configureFirebaseIfNeeded() {
    if FirebaseApp.app() != nil {
        return
    }

    if
        let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
        let options = FirebaseOptions(contentsOfFile: path)
    {
        FirebaseApp.configure(options: options)
        return
    }

    FirebaseApp.configure()
}

private func normalizeEmail(_ email: String) -> String {
    email
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
}

final class FirebaseBootstrapAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil
    ) -> Bool {
        configureFirebaseIfNeeded()
        return true
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey : Any] = [:]
    ) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }
}

@MainActor
final class IOSGoogleAuthController: NSObject, ObservableObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    let bridge = IosAppBridge()
    private var authStateListener: AuthStateDidChangeListenerHandle?
    private var currentAppleNonce: String?

    override init() {
        super.init()

        configureFirebaseIfNeeded()

        bridge.setOnEmailSignInRequested { [weak self] email, password in
            self?.signInWithEmail(email: email, password: password)
        }
        bridge.setOnEmailSignUpRequested { [weak self] email, password in
            self?.signUpWithEmail(email: email, password: password)
        }
        bridge.setOnPasswordResetRequested { [weak self] email in
            self?.sendPasswordReset(email: email)
        }
        bridge.setOnGoogleSignInRequested { [weak self] in
            self?.startGoogleSignIn()
        }
        bridge.setOnAppleSignInRequested { [weak self] in
            self?.startAppleSignIn()
        }
        bridge.setOnAvatarPickRequested { [weak self] in
            self?.pickAvatar()
        }
        bridge.setOnSignOutRequested { [weak self] in
            self?.signOut()
        }

        authStateListener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            guard let self else { return }
            guard let user else {
                self.bridge.updateAuthStateWithToken(
                    uid: nil,
                    idToken: nil,
                    displayName: nil,
                    email: nil,
                    isLoading: false,
                    errorMessage: nil
                )
                return
            }

            user.getIDToken { token, error in
                self.bridge.updateAuthStateWithToken(
                    uid: user.uid,
                    idToken: token,
                    displayName: user.displayName,
                    email: user.email,
                    isLoading: false,
                    errorMessage: error?.localizedDescription
                )
            }
        }
    }

    func signInWithEmail(email: String, password: String) {
        let cleanEmail = normalizeEmail(email)
        guard !cleanEmail.isEmpty, !password.isEmpty else {
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: "Email ve sifre gerekli."
            )
            return
        }

        bridge.updateAuthState(
            displayName: Auth.auth().currentUser?.displayName,
            email: Auth.auth().currentUser?.email,
            isLoading: true,
            errorMessage: nil
        )

        Auth.auth().signIn(withEmail: cleanEmail, password: password) { [weak self] result, error in
            guard let self else { return }

            if let error {
                self.bridge.updateAuthState(
                    displayName: Auth.auth().currentUser?.displayName,
                    email: Auth.auth().currentUser?.email,
                    isLoading: false,
                    errorMessage: error.localizedDescription
                )
                return
            }

            self.refreshBridgeAuthState(
                user: result?.user ?? Auth.auth().currentUser,
                infoMessage: "Web hesabinla ayni Firebase oturumu acildi."
            )
        }
    }

    func signUpWithEmail(email: String, password: String) {
        let cleanEmail = normalizeEmail(email)
        guard !cleanEmail.isEmpty, !password.isEmpty else {
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: "Email ve sifre gerekli."
            )
            return
        }
        guard password.count >= 6 else {
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: "Sifre en az 6 karakter olmali."
            )
            return
        }

        bridge.updateAuthState(
            displayName: Auth.auth().currentUser?.displayName,
            email: Auth.auth().currentUser?.email,
            isLoading: true,
            errorMessage: nil
        )

        Auth.auth().createUser(withEmail: cleanEmail, password: password) { [weak self] result, error in
            guard let self else { return }

            if let error {
                self.bridge.updateAuthState(
                    displayName: Auth.auth().currentUser?.displayName,
                    email: Auth.auth().currentUser?.email,
                    isLoading: false,
                    errorMessage: error.localizedDescription
                )
                return
            }

            let user = result?.user ?? Auth.auth().currentUser
            user?.sendEmailVerification { [weak self] verificationError in
                guard let self else { return }
                let infoMessage = verificationError == nil
                    ? "Hesap olusturuldu. Dogrulama emaili gonderildi."
                    : "Hesap olusturuldu; dogrulama emaili gonderilemedi: \(verificationError?.localizedDescription ?? "")"
                self.refreshBridgeAuthState(user: user, infoMessage: infoMessage)
            }
        }
    }

    func sendPasswordReset(email: String) {
        let cleanEmail = normalizeEmail(email)
        guard !cleanEmail.isEmpty else {
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: "Sifre sifirlama icin email gir."
            )
            return
        }

        bridge.updateAuthState(
            displayName: Auth.auth().currentUser?.displayName,
            email: Auth.auth().currentUser?.email,
            isLoading: true,
            errorMessage: nil
        )

        Auth.auth().sendPasswordReset(withEmail: cleanEmail) { [weak self] error in
            guard let self else { return }

            if let error {
                self.bridge.updateAuthState(
                    displayName: Auth.auth().currentUser?.displayName,
                    email: Auth.auth().currentUser?.email,
                    isLoading: false,
                    errorMessage: error.localizedDescription
                )
                return
            }

            self.bridge.updateAuthInfoState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: nil,
                infoMessage: "Sifre sifirlama emaili gonderildi."
            )
        }
    }

    deinit {
        if let authStateListener {
            Auth.auth().removeStateDidChangeListener(authStateListener)
        }
    }

    func startAppleSignIn() {
        bridge.updateAuthState(
            displayName: Auth.auth().currentUser?.displayName,
            email: Auth.auth().currentUser?.email,
            isLoading: true,
            errorMessage: nil
        )

        let nonce = randomNonceString()
        currentAppleNonce = nonce

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if Thread.isMainThread {
            return UIApplication.shared
                .connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }

        return DispatchQueue.main.sync {
            UIApplication.shared
                .connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { @MainActor in
            guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                bridge.updateAuthState(displayName: nil, email: nil, isLoading: false, errorMessage: "Apple kimligi alinamadi.")
                return
            }

            guard let nonce = currentAppleNonce else {
                bridge.updateAuthState(displayName: nil, email: nil, isLoading: false, errorMessage: "Apple nonce bulunamadi.")
                return
            }

            guard
                let tokenData = appleIDCredential.identityToken,
                let idTokenString = String(data: tokenData, encoding: .utf8)
            else {
                bridge.updateAuthState(displayName: nil, email: nil, isLoading: false, errorMessage: "Apple identity token okunamadi.")
                return
            }

            let credential = OAuthProvider.appleCredential(
                withIDToken: idTokenString,
                rawNonce: nonce,
                fullName: appleIDCredential.fullName
            )

            Auth.auth().signIn(with: credential) { [weak self] result, error in
                guard let self else { return }

                if let error {
                    self.bridge.updateAuthState(
                        displayName: nil,
                        email: nil,
                        isLoading: false,
                        errorMessage: error.localizedDescription
                    )
                    return
                }

                self.bridge.updateAuthState(
                    displayName: result?.user.displayName,
                    email: result?.user.email,
                    isLoading: false,
                    errorMessage: nil
                )
            }
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        Task { @MainActor in
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: error.localizedDescription
            )
        }
    }

    func startGoogleSignIn() {
        bridge.updateAuthState(
            displayName: Auth.auth().currentUser?.displayName,
            email: Auth.auth().currentUser?.email,
            isLoading: true,
            errorMessage: nil
        )

        guard let clientID = FirebaseApp.app()?.options.clientID else {
            bridge.updateAuthState(
                displayName: nil,
                email: nil,
                isLoading: false,
                errorMessage: "Firebase client ID bulunamadi."
            )
            return
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)

        guard let presentingViewController = topViewController() else {
            bridge.updateAuthState(
                displayName: nil,
                email: nil,
                isLoading: false,
                errorMessage: "iOS giris penceresi acilamadi."
            )
            return
        }

        GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { [weak self] result, error in
            guard let self else { return }

            if let error {
                self.bridge.updateAuthState(
                    displayName: Auth.auth().currentUser?.displayName,
                    email: Auth.auth().currentUser?.email,
                    isLoading: false,
                    errorMessage: error.localizedDescription
                )
                return
            }

            guard
                let user = result?.user,
                let idToken = user.idToken?.tokenString
            else {
                self.bridge.updateAuthState(
                    displayName: nil,
                    email: nil,
                    isLoading: false,
                    errorMessage: "Google kimlik bilgisi alinamadi."
                )
                return
            }

            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: user.accessToken.tokenString
            )

            Auth.auth().signIn(with: credential) { [weak self] result, error in
                guard let self else { return }

                if let error {
                    self.bridge.updateAuthState(
                        displayName: nil,
                        email: nil,
                        isLoading: false,
                        errorMessage: error.localizedDescription
                    )
                    return
                }

                self.bridge.updateAuthState(
                    displayName: result?.user.displayName,
                    email: result?.user.email,
                    isLoading: false,
                    errorMessage: nil
                )
            }
        }
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
        } catch {
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: error.localizedDescription
            )
            return
        }

        GIDSignIn.sharedInstance.signOut()
        bridge.updateAuthState(
            displayName: nil,
            email: nil,
            isLoading: false,
            errorMessage: nil
        )
    }

    private func refreshBridgeAuthState(user: User?, infoMessage: String?) {
        guard let user else {
            bridge.updateAuthState(
                displayName: nil,
                email: nil,
                isLoading: false,
                errorMessage: nil
            )
            return
        }

        user.getIDToken { [weak self] token, error in
            guard let self else { return }
            self.bridge.updateAuthStateWithTokenInfo(
                uid: user.uid,
                idToken: token,
                displayName: user.displayName,
                email: user.email,
                isLoading: false,
                errorMessage: error?.localizedDescription,
                infoMessage: infoMessage
            )
        }
    }

    func pickAvatar() {
        guard Auth.auth().currentUser != nil else {
            bridge.updateAuthState(
                displayName: nil,
                email: nil,
                isLoading: false,
                errorMessage: "Avatar yuklemek icin giris yapmalisin."
            )
            return
        }

        guard let presentingViewController = topViewController() else {
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: "iOS picker acilamadi."
            )
            return
        }

        let picker = UIImagePickerController()
        picker.delegate = self
        picker.sourceType = .photoLibrary
        picker.mediaTypes = ["public.image"]
        presentingViewController.present(picker, animated: true)
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }

    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]
    ) {
        picker.dismiss(animated: true)

        guard
            let user = Auth.auth().currentUser,
            let image = info[.originalImage] as? UIImage,
            let data = image.jpegData(compressionQuality: 0.84)
        else {
            bridge.updateAuthState(
                displayName: Auth.auth().currentUser?.displayName,
                email: Auth.auth().currentUser?.email,
                isLoading: false,
                errorMessage: "Secilen gorsel okunamadi."
            )
            return
        }

        bridge.updateAuthState(
            displayName: user.displayName,
            email: user.email,
            isLoading: true,
            errorMessage: nil
        )

        let ref = Storage.storage().reference().child("users/\(user.uid)/avatar.jpg")
        let metadata = StorageMetadata()
        metadata.contentType = "image/jpeg"
        ref.putData(data, metadata: metadata) { [weak self] _, error in
            guard let self else { return }
            if let error {
                self.bridge.updateAuthState(
                    displayName: user.displayName,
                    email: user.email,
                    isLoading: false,
                    errorMessage: error.localizedDescription
                )
                return
            }

            ref.downloadURL { url, error in
                if let error {
                    self.bridge.updateAuthState(
                        displayName: user.displayName,
                        email: user.email,
                        isLoading: false,
                        errorMessage: error.localizedDescription
                    )
                    return
                }

                let changeRequest = user.createProfileChangeRequest()
                changeRequest.photoURL = url
                changeRequest.commitChanges { error in
                    self.bridge.updateAuthState(
                        displayName: user.displayName,
                        email: user.email,
                        isLoading: false,
                        errorMessage: error?.localizedDescription
                    )
                }
            }
        }
    }

    private func topViewController(from controller: UIViewController? = nil) -> UIViewController? {
        let currentController = controller ?? UIApplication.shared
            .connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController

        if let navigationController = currentController as? UINavigationController {
            return topViewController(from: navigationController.visibleViewController)
        }

        if let tabBarController = currentController as? UITabBarController {
            return topViewController(from: tabBarController.selectedViewController)
        }

        if let presentedViewController = currentController?.presentedViewController {
            return topViewController(from: presentedViewController)
        }

        return currentController
    }

    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            let status = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
            if status != errSecSuccess {
                return UUID().uuidString.replacingOccurrences(of: "-", with: "")
            }

            randoms.forEach { random in
                if remainingLength == 0 {
                    return
                }

                if Int(random) < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }

        return result
    }

    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        return hashedData.map { String(format: "%02x", $0) }.joined()
    }
}

@main
struct EvalonApp: App {
    @UIApplicationDelegateAdaptor(FirebaseBootstrapAppDelegate.self) private var appDelegate
    @StateObject private var authController: IOSGoogleAuthController

    init() {
        configureFirebaseIfNeeded()
        _authController = StateObject(wrappedValue: IOSGoogleAuthController())
    }

    var body: some Scene {
        WindowGroup {
            ComposeView(bridge: authController.bridge)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
