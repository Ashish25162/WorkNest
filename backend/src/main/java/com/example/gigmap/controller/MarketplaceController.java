package com.example.gigmap.controller;

import com.example.gigmap.model.Worker;
import com.example.gigmap.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/workers")
@CrossOrigin(originPatterns = "*") // CrossOrigin is allowed, though we proxy via Vite
public class MarketplaceController {

    @Autowired
    private WorkerRepository workerRepository;

    @GetMapping
    public List<Worker> getAllWorkers() {
        return workerRepository.findAll();
    }

    @GetMapping("/available")
    public List<Worker> getAvailableWorkers() {
        return workerRepository.findByAvailable(true);
    }

    @PostMapping("/register")
    public ResponseEntity<Worker> registerWorker(@RequestBody Worker worker) {
        if (worker.getRating() == null) {
            worker.setRating(5.0);
        }
        Worker savedWorker = workerRepository.save(worker);
        return ResponseEntity.ok(savedWorker);
    }

    @PutMapping("/{id}/location")
    public ResponseEntity<?> updateLocation(@PathVariable Long id, @RequestParam Double latitude, @RequestParam Double longitude) {
        Optional<Worker> workerOpt = workerRepository.findById(id);
        if (workerOpt.isPresent()) {
            Worker worker = workerOpt.get();
            worker.setLatitude(latitude);
            worker.setLongitude(longitude);
            workerRepository.save(worker);
            return ResponseEntity.ok(worker);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/availability")
    public ResponseEntity<?> toggleAvailability(@PathVariable Long id, @RequestParam Boolean available) {
        Optional<Worker> workerOpt = workerRepository.findById(id);
        if (workerOpt.isPresent()) {
            Worker worker = workerOpt.get();
            // We interpret 'available' from the frontend as the Online/Offline toggle -> map to isActive
            worker.setIsActive(available);
            if (!available) {
                worker.setAvailable(false); // If offline, they are definitely not available
            } else {
                worker.setAvailable(true); // If coming online, make them available (assuming they have no active job right now)
            }
            workerRepository.save(worker);
            return ResponseEntity.ok(worker);
        }
        return ResponseEntity.notFound().build();
    }
}
