package com.evalon.shared.presentation.screens.watchlist

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.evalon.shared.presentation.components.*
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun WatchlistScreen(
    component: WatchlistComponent,
    viewModel: WatchlistViewModel,
    onStockClick: (String) -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "İzleme Listem", onBackClick = onBack)
        },
        containerColor = EvalonDarkBg
    ) { padding ->
        if (state.isLoading) {
            EvalonLoadingState(modifier = Modifier.padding(padding))
        } else if (state.groups.isEmpty()) {
            EvalonEmptyState(
                icon = Icons.Default.BookmarkBorder,
                title = "İzleme Listeniz Boş",
                description = "Takip etmek istediğiniz hisseleri buraya ekleyin.",
                actionLabel = "Hisse Ekle",
                onAction = { },
                modifier = Modifier.padding(padding)
            )
        } else {
            LazyColumn(
                modifier = Modifier.padding(padding).fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                item {
                    EvalonSearchBar(
                        query = state.searchQuery,
                        onQueryChange = viewModel::onSearchQueryChange,
                        placeholder = "İzleme listesinde ara..."
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                state.groups.forEach { group ->
                    item {
                        SectionHeader(title = group.name, showAll = true, onShowAllClick = { })
                    }

                    items(group.stocks) { stock ->
                        StockListItem(stock = stock, onClick = { onStockClick(stock.symbol) })
                    }

                    item { Spacer(modifier = Modifier.height(8.dp)) }
                }
            }
        }
    }
}
