package com.example.gigmap.config;

import com.example.gigmap.model.SystemConfig;
import com.example.gigmap.model.User;
import com.example.gigmap.model.Worker;
import com.example.gigmap.repository.SystemConfigRepository;
import com.example.gigmap.repository.UserRepository;
import com.example.gigmap.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private SystemConfigRepository configRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public void run(String... args) throws Exception {
        // Seed default commission percentage if empty
        if (!configRepository.existsById("COMMISSION_PERCENTAGE")) {
            configRepository.save(new SystemConfig("COMMISSION_PERCENTAGE", 10.0));
        }

        // Seed admin user
        if (!userRepository.existsByEmail("admin@gigmap.com")) {
            User admin = new User("Admin", "9999999999", "admin@gigmap.com", "GigMap HQ", "admin123", "ADMIN", "");
            admin.setVerified(true);
            userRepository.save(admin);
            System.out.println("Admin user seeded: admin@gigmap.com / admin123");
        }

        // Cleanup fake data
        java.util.List<String> fakeEmails = java.util.Arrays.asList("john@gigmap.com", "jane@gigmap.com", "bob@gigmap.com", "alice@gigmap.com");
        for (String e : fakeEmails) {
            User u = userRepository.findByEmail(e).orElse(null);
            if (u != null) {
                Worker w = workerRepository.findByUserId(u.getId()).orElse(null);
                if (w != null) workerRepository.delete(w);
                userRepository.delete(u);
            }
        }
    }
}

