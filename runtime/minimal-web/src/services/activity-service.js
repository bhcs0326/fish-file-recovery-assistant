class ActivityService {
  constructor(activityLogRepository) {
    this.activityLogRepository = activityLogRepository;
  }

  listRecent() {
    return this.activityLogRepository.listRecent(10);
  }
}

module.exports = {
  ActivityService
};
