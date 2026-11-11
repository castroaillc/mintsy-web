import SwiftUI

/// The paywall's page: what Premium is, the plans, the button with its terms, and the ways out.
struct PaywallContent: View {
    let model: PaywallModel
    let episodeID: String?
    let onClose: () -> Void
    let onSubscribed: () -> Void

    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let blocked = episodeID.flatMap(catalog.episode(id:)) {
                    BlockedEpisodeCard(book: blocked.book, episode: blocked.episode)
                        .padding(.bottom, 26)
                }
                PaywallTitle()
                Text("Every episode of every book. Free accounts get the first \(SharedConstants.freeEpisodes) episodes of each series.")
                    .font(BrandFont.inter(16))
                    .lineSpacing(4)
                    .foregroundStyle(Palette.mutedForeground)
                    .padding(.top, 10)
                BenefitList()
                    .padding(.top, 22)
                PlanPicker(model: model, onRetry: reload)
                    .padding(.top, 26)

                SubmitButton(title: model.callToAction, isBusy: model.activity == .purchasing, height: 56, action: buy)
                    .disabled(model.selectedPlan == nil || model.activity == .restoring)
                    .padding(.top, 20)
                Text(model.finePrint)
                    .font(BrandFont.inter(12, relativeTo: .caption))
                    .lineSpacing(3)
                    .foregroundStyle(Palette.faint)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
                PaywallLegalLinks()
                    .padding(.top, 4)
                Button("Not now, keep browsing free episodes", action: onClose)
                    .font(BrandFont.inter(15, .medium, relativeTo: .subheadline))
                    .foregroundStyle(Palette.mutedForeground)
                    .frame(maxWidth: .infinity, minHeight: Metrics.minTap)
                    .contentShape(.rect)
                    .buttonStyle(.plain)
                    .padding(.top, 6)
            }
            .padding(.horizontal, 24)
            .padding(.top, 10)
            .padding(.bottom, 28)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.background)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close", systemImage: "xmark", action: onClose)
            }
            ToolbarItem(placement: .primaryAction) {
                if model.activity == .restoring {
                    ProgressView()
                        .accessibilityLabel("Restoring purchases")
                } else {
                    Button("Restore purchases", action: restore)
                        .disabled(model.activity != nil)
                }
            }
        }
        .alert(model.notice?.title ?? "", item: $model.notice) { _ in
        } message: { notice in
            Text(notice.message)
        }
    }

    private func buy() {
        Task {
            if await model.buy() { onSubscribed() }
        }
    }

    private func restore() {
        Task {
            if await model.restore() { onSubscribed() }
        }
    }

    private func reload() {
        Task {
            if await model.load() { onSubscribed() }
        }
    }
}
