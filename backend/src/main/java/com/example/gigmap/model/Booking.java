package com.example.gigmap.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String customerName;
    private String taskDescription;
    private String professionCategory; // For broadcast routing
    private String startOtp; // 4-digit OTP for starting work

    @Column(nullable = true)
    private Long workerId;
    @Column(nullable = true)
    private String workerName;

    private Double initialHours;
    private Double actualHours; // Can increase if job takes longer

    private Double startLat; // Customer latitude
    private Double startLng; // Customer longitude
    
    private String serviceAddress; // Manual text location if gps fails


    private Double workerStartLat; // Where worker started
    private Double workerStartLng; // Where worker started

    private Double workerCurrentLat; // Simulated current position
    private Double workerCurrentLng; // Simulated current position

    private Double distanceKm;
    private Double ratePerHour;
    private Double ratePerKm;

    private Double travelCost;
    private Double serviceCost;
    private Double totalCost;
    private Double commissionRate; // Store the % at booking time (e.g. 10.0)
    private Double commissionAmount; // commissionRate % of totalCost

    private String status; // PENDING, ACCEPTED, EN_ROUTE, ACTIVE, COMPLETED, CANCELLED

    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    public Booking() {}

    public Booking(String customerName, String taskDescription, String professionCategory, Double initialHours, Double startLat, Double startLng, String serviceAddress, Double travelCost, Double serviceCost, Double totalCost, String startOtp) {
        this.customerName = customerName;
        this.taskDescription = taskDescription;
        this.professionCategory = professionCategory;
        this.initialHours = initialHours;
        this.actualHours = initialHours;
        this.startLat = startLat;
        this.startLng = startLng;
        this.serviceAddress = serviceAddress;
        
        // At creation, no worker is assigned
        this.workerId = null;
        this.workerName = null;
        
        this.status = "BROADCAST";
        this.createdAt = LocalDateTime.now();
        this.startOtp = startOtp;
        
        this.travelCost = travelCost;
        this.serviceCost = serviceCost;
        this.totalCost = totalCost;
        
        // Calculate commission
        recalculateCosts(10.0); // Default commission rate
    }

    public void recalculateCosts(Double currentCommissionRate) {
        this.commissionRate = currentCommissionRate;
        if (this.totalCost != null) {
            this.commissionAmount = this.totalCost * (this.commissionRate / 100.0);
        }
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        // Simple Haversine formula
        double R = 6371; // Earth's radius in KM
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getTaskDescription() {
        return taskDescription;
    }

    public void setTaskDescription(String taskDescription) {
        this.taskDescription = taskDescription;
    }

    public String getProfessionCategory() {
        return professionCategory;
    }

    public void setProfessionCategory(String professionCategory) {
        this.professionCategory = professionCategory;
    }

    public String getStartOtp() {
        return startOtp;
    }

    public void setStartOtp(String startOtp) {
        this.startOtp = startOtp;
    }

    public Long getWorkerId() {
        return workerId;
    }

    public void setWorkerId(Long workerId) {
        this.workerId = workerId;
    }

    public String getWorkerName() {
        return workerName;
    }

    public void setWorkerName(String workerName) {
        this.workerName = workerName;
    }

    public Double getInitialHours() {
        return initialHours;
    }

    public void setInitialHours(Double initialHours) {
        this.initialHours = initialHours;
    }

    public Double getActualHours() {
        return actualHours;
    }

    public void setActualHours(Double actualHours) {
        this.actualHours = actualHours;
    }

    public Double getStartLat() {
        return startLat;
    }

    public void setStartLat(Double startLat) {
        this.startLat = startLat;
    }

    public Double getStartLng() {
        return startLng;
    }

    public void setStartLng(Double startLng) {
        this.startLng = startLng;
    }

    public String getServiceAddress() {
        return serviceAddress;
    }

    public void setServiceAddress(String serviceAddress) {
        this.serviceAddress = serviceAddress;
    }

    public Double getWorkerStartLat() {
        return workerStartLat;
    }

    public void setWorkerStartLat(Double workerStartLat) {
        this.workerStartLat = workerStartLat;
    }

    public Double getWorkerStartLng() {
        return workerStartLng;
    }

    public void setWorkerStartLng(Double workerStartLng) {
        this.workerStartLng = workerStartLng;
    }

    public Double getWorkerCurrentLat() {
        return workerCurrentLat;
    }

    public void setWorkerCurrentLat(Double workerCurrentLat) {
        this.workerCurrentLat = workerCurrentLat;
    }

    public Double getWorkerCurrentLng() {
        return workerCurrentLng;
    }

    public void setWorkerCurrentLng(Double workerCurrentLng) {
        this.workerCurrentLng = workerCurrentLng;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(Double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public Double getRatePerHour() {
        return ratePerHour;
    }

    public void setRatePerHour(Double ratePerHour) {
        this.ratePerHour = ratePerHour;
    }

    public Double getRatePerKm() {
        return ratePerKm;
    }

    public void setRatePerKm(Double ratePerKm) {
        this.ratePerKm = ratePerKm;
    }

    public Double getTravelCost() {
        return travelCost;
    }

    public void setTravelCost(Double travelCost) {
        this.travelCost = travelCost;
    }

    public Double getServiceCost() {
        return serviceCost;
    }

    public void setServiceCost(Double serviceCost) {
        this.serviceCost = serviceCost;
    }

    public Double getTotalCost() {
        return totalCost;
    }

    public void setTotalCost(Double totalCost) {
        this.totalCost = totalCost;
    }

    public Double getCommissionRate() {
        return commissionRate;
    }

    public void setCommissionRate(Double commissionRate) {
        this.commissionRate = commissionRate;
    }

    public Double getCommissionAmount() {
        return commissionAmount;
    }

    public void setCommissionAmount(Double commissionAmount) {
        this.commissionAmount = commissionAmount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}
