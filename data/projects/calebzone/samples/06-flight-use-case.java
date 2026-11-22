package com.calebzone.air.application.search.service;

import com.calebzone.air.application.search.port.in.SearchFlightsUseCase;
import com.calebzone.air.application.search.port.out.FlightCachePort;
import com.calebzone.air.application.search.port.out.FlightSupplierPort;
import com.calebzone.air.domain.search.FlightSearchResults;
import com.calebzone.air.domain.search.SearchCriteria;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Application Service: Orchestrates the flight search use case.
 * Coordinates between port-out interfaces (cache, supplier) without containing business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchFlightsService implements SearchFlightsUseCase {
    private final FlightSupplierPort supplierPort;
    private final FlightCachePort cachePort;

    @Override
    public FlightSearchResults search(SearchCriteria criteria) {
        // 1. Check cache first
        Optional<FlightSearchResults> cachedResults = cachePort.getCachedResults(criteria);
        if (cachedResults.isPresent()) {
            log.info("Found results in cache for criteria: {}", criteria);
            return cachedResults.get();
        }

        // 2. Call external supplier via port-out
        FlightSearchResults results = supplierPort.searchExternalFlights(criteria);

        // 3. Cache the results
        if (results != null && results.getItineraries() != null && !results.getItineraries().isEmpty()) {
            log.info("Caching {} results from supplier", results.getItineraries().size());
            cachePort.cacheResults(criteria, results);
        }

        return results;
    }
}
